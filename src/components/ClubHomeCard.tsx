import CachedMediaImage from './CachedMediaImage';
import { moderationMediaUrl } from '../lib/moderation-media-url';
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNovoriTheme } from '../context/theme-context';
import { getClubGenreLabel } from '../constants/club-genres';
import type { ClubWithMembership } from '../lib/clubs';

type Props = {
  club: ClubWithMembership;
  canViewMembers: boolean;
  rulesExpanded: boolean;
  membersVisible: boolean;
  onPhoto: () => void;
  onMembers: () => void;
  onCloseRules: () => void;
  onEdit: () => void;
  onInvite?: () => void;
};

export default function ClubHomeCard({ club, canViewMembers, rulesExpanded, membersVisible, onPhoto, onMembers, onCloseRules, onEdit, onInvite }: Props) {
  const { colors } = useNovoriTheme();
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const styles = useMemo(() => StyleSheet.create({
    card: { borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', marginBottom: 12 },
    identity: { gap: 12, paddingHorizontal: 18, paddingTop: 20, paddingBottom: 14, alignItems: 'center' },
    photo: { width: 82, height: 82, borderRadius: 41, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    image: { width: '100%', height: '100%' }, initial: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 34, color: colors.gold },
    identityCopy: { alignItems: 'center', alignSelf: 'stretch' }, badges: { flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', marginTop: 5 },
    badge: { color: colors.mutedText, fontFamily: 'Inter_500Medium', fontSize: 11 },
    name: { fontFamily: 'PlayfairDisplay_700Bold', color: colors.text, fontSize: 28, lineHeight: 35, textAlign: 'center' },
    members: { color: colors.mutedText, fontFamily: 'Inter_500Medium', fontSize: 12, textAlign: 'center', marginTop: 6 },
    body: { paddingHorizontal: 16, paddingBottom: 13 }, description: { color: colors.secondaryText, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20 },
    genres: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 11 }, genre: { backgroundColor: `${colors.gold}09`, borderWidth: 1, borderColor: `${colors.gold}20`, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
    genreText: { color: colors.gold, fontFamily: 'Inter_500Medium', fontSize: 10 },
    links: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    link: { flex: 1, minHeight: 48, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
    inviteLink: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.border },
    linkText: { color: colors.gold, fontFamily: 'Inter_600SemiBold', fontSize: 11 },
    rules: { marginHorizontal: 16, marginBottom: 14, padding: 12, borderRadius: 12, backgroundColor: `${colors.gold}06`, borderWidth: 1, borderColor: `${colors.gold}25` },
    rulesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    rulesTitle: { color: colors.gold, fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: .8 },
    editRules: { minHeight: 40, justifyContent: 'center', alignSelf: 'flex-start' }, pressed: { opacity: .75 },
  }), [colors]);
  const owner = club.membership_role === 'owner';
  const manager = owner || club.membership_role === 'admin';
  const showRules = Boolean(club.rules?.trim()) || owner;
  return <View style={styles.card}>
    <View style={styles.identity}>
      <Pressable disabled={!club.cover_url} onPress={onPhoto} accessibilityRole="button" accessibilityLabel="Enlarge club photo" style={styles.photo}>
        {club.cover_url ? <CachedMediaImage source={{ uri: moderationMediaUrl(club.cover_url) }} style={styles.image} /> : <Text style={styles.initial}>{club.name.charAt(0).toUpperCase()}</Text>}
      </Pressable>
      <View style={styles.identityCopy}>
        <Text style={styles.name} accessibilityRole="header">{club.name}</Text>
        <View style={styles.badges}><Ionicons name={club.privacy === 'private' ? 'lock-closed-outline' : 'earth-outline'} size={12} color={colors.gold} />
          <Text style={styles.badge}>{club.privacy === 'private' ? 'Private club' : 'Public club'}</Text>
          {club.membership_role ? <Text style={styles.badge}>· {owner ? 'Owner' : manager ? 'Admin' : 'Member'}</Text> : null}
        </View>
        {!canViewMembers ? <Text style={styles.members}>{club.member_count.toLocaleString()} {club.member_count === 1 ? 'member' : 'members'}</Text> : null}
      </View>
    </View>
    {club.description || club.genres?.length ? <View style={styles.body}>
      {club.description ? <Text style={[styles.description, { textAlign: 'center' }]} numberOfLines={descriptionExpanded ? undefined : 4}>{club.description}</Text> : null}
      {((club.description ?? '').length > 180 || (club.description ?? '').split('\n').length > 4) ? <Pressable accessibilityRole="button" accessibilityLabel={descriptionExpanded ? 'Show less club description' : 'Read full club description'} onPress={() => setDescriptionExpanded(value => !value)} style={styles.editRules}><Text style={styles.linkText}>{descriptionExpanded ? 'Show less' : 'Read more'}</Text></Pressable> : null}
      {club.genres?.length ? <View style={styles.genres}>{club.genres.map(genre => <View key={genre} style={styles.genre}><Text style={styles.genreText}>{getClubGenreLabel(genre)}</Text></View>)}</View> : null}
    </View> : null}
    {canViewMembers || onInvite ? <View style={styles.links}>
      {canViewMembers ? <Pressable accessibilityRole="button" accessibilityLabel={`View ${club.member_count} club members`} accessibilityState={{ expanded: membersVisible }} onPress={onMembers} style={({ pressed }) => [styles.link, pressed && styles.pressed]}><Ionicons name="people-outline" size={16} color={colors.gold} /><Text style={styles.linkText}>{club.member_count.toLocaleString()} {club.member_count === 1 ? 'member' : 'members'}</Text></Pressable> : null}
      {onInvite ? <Pressable accessibilityRole="button" onPress={onInvite} style={({ pressed }) => [styles.link, canViewMembers && styles.inviteLink, pressed && styles.pressed]}>
        <Ionicons name="person-add-outline" size={16} color={colors.gold}/><Text style={styles.linkText}>Invite readers</Text>
      </Pressable> : null}
    </View> : null}
    {rulesExpanded && showRules ? <View style={styles.rules}><View style={styles.rulesHeader}><Text style={styles.rulesTitle}>CLUB RULES</Text><Pressable accessibilityRole="button" accessibilityLabel="Close club rules" onPress={onCloseRules} hitSlop={10}><Ionicons name="close" size={20} color={colors.mutedText}/></Pressable></View><Text style={styles.description}>{club.rules?.trim() || 'Set a few guidelines to help everyone feel at home in your club.'}</Text>
      {owner ? <Pressable accessibilityRole="button" accessibilityLabel="Edit club rules" onPress={onEdit} style={styles.editRules}><Text style={styles.linkText}>{club.rules?.trim() ? 'Edit rules' : 'Add rules'}</Text></Pressable> : null}
    </View> : null}
  </View>;
}
