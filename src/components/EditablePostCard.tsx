import { moderationMediaUrl } from '../lib/moderation-media-url';
import { Ionicons } from '@expo/vector-icons';
import { ReactNode, useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { NovoriColors } from '../constants/novori-theme';
import { useNovoriTheme } from '../context/theme-context';
import { FeedPostType } from '../lib/feed';
import { PostComposerProfile } from '../hooks/use-post-composer-profile';
import PostTypeIdentifier from './PostTypeIdentifier';
import ClubDestinationImage from './ClubDestinationImage';

type Props = {
  children: ReactNode;
  postType: FeedPostType;
  clubId?: string | null;
  clubName?: string | null;
  clubCoverUrl?: string | null;
  author?: PostComposerProfile | null;
  readingRecap?: boolean;
};

// The feed's outer post card, with composition controls in place of post actions.
export default function EditablePostCard({
  children, postType, clubId = null, clubName, clubCoverUrl, author, readingRecap = false,
}: Props) {
  const { colors } = useNovoriTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const displayName = author?.display_name?.trim() || author?.username?.trim() || 'You';
  const audience = clubId
    ? clubName || 'Your club'
    : 'Your feed';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        {author?.avatar_url ? (
          <Image source={{ uri: moderationMediaUrl(author.avatar_url) }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.initial}>{displayName.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.authorCopy}>
          <View style={styles.identity}>
            <Text style={styles.authorName} numberOfLines={1}>{displayName}</Text>
            {author?.username ? (
              <Text style={styles.username} numberOfLines={1}>@{author.username}</Text>
            ) : null}
          </View>
          <View style={styles.audience}>
            {clubId ? <ClubDestinationImage club={{ name: audience, cover_url: clubCoverUrl ?? null }} size={18} /> : <Ionicons name="person-outline" size={13} color={colors.gold} />}
            <Text style={styles.audienceText} numberOfLines={1}>{clubId ? `in ${audience}` : audience}</Text>
          </View>
        </View>
      </View>
      <View style={styles.content}>
        <PostTypeIdentifier postType={postType} colors={colors} readingRecap={readingRecap} />
        {children}
      </View>
      <View style={styles.footer} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={styles.votes}>
          <Ionicons name="arrow-up-circle-outline" size={20} color={colors.mutedText} />
          <Text style={styles.count}>0</Text>
          <Ionicons name="arrow-down-circle-outline" size={20} color={colors.mutedText} />
        </View>
        <View style={styles.votes}>
          <Ionicons name="chatbubble-outline" size={17} color={colors.mutedText} />
          <Text style={styles.count}>0</Text>
        </View>
      </View>
    </View>
  );
}

function createStyles(colors: NovoriColors) {
  return StyleSheet.create({
    card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 22, overflow: 'hidden', shadowColor: '#000000', shadowOpacity: 0.10, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
    header: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingTop: 15 },
    avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.border, marginRight: 12 },
    avatarFallback: { alignItems: 'center', justifyContent: 'center' },
    initial: { color: colors.text, fontFamily: 'PlayfairDisplay_700Bold', fontSize: 18 },
    authorCopy: { flex: 1, minWidth: 0, paddingTop: 2 },
    identity: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    authorName: { color: colors.text, fontFamily: 'Inter_700Bold', fontSize: 13.5, flexShrink: 1 },
    username: { color: colors.mutedText, fontFamily: 'Inter_400Regular', fontSize: 11.5, flexShrink: 1 },
    audience: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5, maxWidth: '100%' },
    audienceText: { color: colors.mutedText, fontFamily: 'Inter_400Regular', fontSize: 10.5, flexShrink: 1 },
    content: { paddingHorizontal: 16, paddingTop: 14 },
    footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border, marginTop: 15, paddingHorizontal: 14, paddingVertical: 12 },
    votes: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    count: { color: colors.mutedText, fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  });
}
