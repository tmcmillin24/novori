import { Ionicons } from '@expo/vector-icons';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { NovoriColors } from '../constants/novori-theme';
import { useNovoriTheme } from '../context/theme-context';
import { ClubWithMembership, getMyClubs } from '../lib/clubs';
import { FeedPostType } from '../lib/feed';
import { supabase } from '../lib/supabase';
import PostTypeIdentifier from './PostTypeIdentifier';

type Props = {
  children: ReactNode;
  postType: FeedPostType;
  disabled?: boolean;
  clubId?: string | null;
  clubName?: string | null;
  onClubIdChange?: (clubId: string | null) => void;
};

type Author = {
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

// The feed's outer post card, with composition controls in place of post actions.
export default function EditablePostCard({
  children, postType, disabled = false, clubId = null, clubName, onClubIdChange,
}: Props) {
  const { colors } = useNovoriTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [author, setAuthor] = useState<Author | null>(null);
  const [clubs, setClubs] = useState<ClubWithMembership[]>([]);
  const [loadingClubs, setLoadingClubs] = useState(Boolean(onClubIdChange));
  const [audienceExpanded, setAudienceExpanded] = useState(false);
  const canChooseAudience = Boolean(onClubIdChange);

  useEffect(() => {
    let active = true;
    async function loadHeader() {
      const results = await Promise.allSettled([
        (async () => {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return null;
          const { data, error } = await supabase.from('profiles')
            .select('display_name, username, avatar_url').eq('id', user.id).single();
          if (error) throw error;
          return data as Author;
        })(),
        canChooseAudience ? getMyClubs() : Promise.resolve([]),
      ]);
      if (!active) return;
      if (results[0].status === 'fulfilled') setAuthor(results[0].value);
      if (results[1].status === 'fulfilled') setClubs(results[1].value);
      setLoadingClubs(false);
    }
    void loadHeader();
    return () => { active = false; };
  }, [canChooseAudience]);

  const displayName = author?.display_name?.trim() || author?.username?.trim() || 'You';
  const audience = clubId
    ? clubs.find((club) => club.id === clubId)?.name || clubName || 'Your club'
    : 'Your profile';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        {author?.avatar_url ? (
          <Image source={{ uri: author.avatar_url }} style={styles.avatar} />
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
          <Pressable
            accessibilityRole={canChooseAudience ? 'button' : undefined}
            accessibilityLabel={`Post to ${audience}`}
            accessibilityState={{ expanded: audienceExpanded, disabled: disabled || loadingClubs || !canChooseAudience }}
            disabled={disabled || loadingClubs || !canChooseAudience}
            onPress={() => setAudienceExpanded((current) => !current)}
            style={({ pressed }) => [styles.audience, pressed && styles.pressed]}
          >
            <Ionicons name={clubId ? 'people-outline' : 'person-outline'} size={13} color={colors.gold} />
            <Text style={styles.audienceText} numberOfLines={1}>{clubId ? `in ${audience}` : audience}</Text>
            {loadingClubs ? <ActivityIndicator size="small" color={colors.mutedText} /> : canChooseAudience ? (
              <Ionicons name={audienceExpanded ? 'chevron-up' : 'chevron-down'} size={13} color={colors.mutedText} />
            ) : null}
          </Pressable>
        </View>
      </View>
      {audienceExpanded ? (
        <View style={styles.audienceMenu}>
          {[{ id: null, name: 'Your profile' }, ...clubs].map((club) => (
            <Pressable
              key={club.id ?? 'profile'}
              accessibilityRole="button"
              accessibilityState={{ selected: clubId === club.id }}
              disabled={disabled}
              onPress={() => { onClubIdChange?.(club.id); setAudienceExpanded(false); }}
              style={({ pressed }) => [styles.audienceOption, pressed && styles.pressed]}
            >
              <Ionicons name={club.id ? 'people-outline' : 'person-outline'} size={18} color={colors.gold} />
              <Text style={styles.audienceOptionText} numberOfLines={1}>{club.name}</Text>
              {clubId === club.id ? <Ionicons name="checkmark" size={18} color={colors.gold} /> : null}
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={styles.content}>
        <PostTypeIdentifier postType={postType} colors={colors} />
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
    audienceMenu: { marginHorizontal: 16, marginTop: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, overflow: 'hidden' },
    audienceOption: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    audienceOptionText: { flex: 1, color: colors.text, fontFamily: 'Inter_500Medium', fontSize: 12.5 },
    content: { paddingHorizontal: 16, paddingTop: 14 },
    footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border, marginTop: 15, paddingHorizontal: 14, paddingVertical: 12 },
    votes: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    count: { color: colors.mutedText, fontFamily: 'Inter_600SemiBold', fontSize: 12 },
    pressed: { opacity: 0.7 },
  });
}
