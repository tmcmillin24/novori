import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNovoriTheme } from '../context/theme-context';
import type { FeedPost } from '../lib/feed';

type Props = { posts: FeedPost[]; canManage: boolean; busy: boolean; onOpen: (postId: string) => void; onManage: (post: FeedPost) => void };

export default function ClubPinnedPosts({ posts,canManage,busy,onOpen,onManage }: Props) {
  const { colors } = useNovoriTheme();
  const styles = useMemo(() => StyleSheet.create({
    section: { marginBottom: 0 }, heading: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 9 },
    title: { color: colors.gold, fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: .8 },
    card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: `${colors.gold}40`, borderRadius: 14, marginBottom: 7, overflow: 'hidden' },
    lastCard: { marginBottom: 0 },
    open: { flex: 1, minHeight: 70, paddingHorizontal: 13, paddingVertical: 11 },
    label: { color: colors.gold, fontFamily: 'Inter_600SemiBold', fontSize: 9, marginBottom: 4 },
    body: { color: colors.text, fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 18 },
    author: { color: colors.mutedText, fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 5 },
    manage: { width: 44, minHeight: 70, alignItems: 'center', justifyContent: 'center' }, pressed: { opacity: .75 },
  }),[colors]);
  if (!posts.length) return null;
  return <View style={styles.section}>
    <View style={styles.heading}><Ionicons name="pin" size={14} color={colors.gold} /><Text style={styles.title}>PINNED · {posts.length}</Text></View>
    {posts.map((post,index) => <View key={post.id} style={[styles.card,index === posts.length - 1 && styles.lastCard]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open pinned post: ${post.club_event?.title || post.body.trim().slice(0,80) || post.book_title || 'Book stack'}`} onPress={() => onOpen(post.id)} style={({ pressed }) => [styles.open,pressed && styles.pressed]}>
        <Text style={styles.label}>{post.club_event ? 'CLUB EVENT' : post.is_club_announcement ? 'ANNOUNCEMENT' : post.reading_recap ? 'READING RECAP' : post.post_type.replace('_',' ').toUpperCase()}</Text>
        <Text style={styles.body} numberOfLines={2}>{post.club_event?.title || post.body.trim() || post.book_title || 'Book stack'}</Text>
        <Text style={styles.author} numberOfLines={1}>{post.author_display_name || post.author_username || 'Novori Reader'}</Text>
      </Pressable>
      {canManage ? <Pressable disabled={busy} accessibilityRole="button" accessibilityLabel={`Manage pin: ${post.id}`} onPress={() => onManage(post)} style={({ pressed }) => [styles.manage,pressed && styles.pressed]}><Ionicons name="ellipsis-horizontal" size={18} color={colors.mutedText} /></Pressable> : null}
    </View>)}
  </View>;
}
