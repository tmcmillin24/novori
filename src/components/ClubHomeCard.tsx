import { moderationMediaUrl } from '../lib/moderation-media-url';
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNovoriTheme } from '../context/theme-context';
import { getClubGenreLabel } from '../constants/club-genres';
import type { ClubWithMembership } from '../lib/clubs';

type Props = {
  club: ClubWithMembership; canViewMembers: boolean; rulesExpanded: boolean; membersVisible: boolean; managementVisible: boolean;
  pendingRequests: number; pendingInvites: number;
  onPhoto: () => void; onRules: () => void; onMembers: () => void; onManage: () => void; onEdit: () => void;
};

export default function ClubHomeCard({ club, canViewMembers, rulesExpanded, membersVisible, managementVisible, pendingRequests, pendingInvites, onPhoto, onRules, onMembers, onManage, onEdit }: Props) {
  const { colors } = useNovoriTheme();
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const styles = useMemo(() => StyleSheet.create({
    shadow: { shadowColor: '#000', shadowOpacity: .13, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 3, marginBottom: 12 },
    card: { borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: `${colors.gold}45`, overflow: 'hidden' },
    accent: { height: 3, backgroundColor: colors.gold },
    glow: { position: 'absolute', width: 180, height: 180, borderRadius: 90, top: -70, right: -60, backgroundColor: `${colors.gold}08` },
    identity: { flexDirection: 'row', gap: 14, padding: 16, alignItems: 'center' },
    photo: { width: 82, height: 82, borderRadius: 18, borderWidth: 1, borderColor: `${colors.gold}35`, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    image: { width: '100%', height: '100%' }, initial: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 34, color: colors.gold },
    identityCopy: { flex: 1 }, badges: { flexDirection: 'row', gap: 7, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 },
    badge: { color: colors.gold, fontFamily: 'Inter_600SemiBold', fontSize: 10 },
    name: { fontFamily: 'PlayfairDisplay_700Bold', color: colors.text, fontSize: 25, lineHeight: 31 },
    members: { color: colors.mutedText, fontFamily: 'Inter_500Medium', fontSize: 11, marginTop: 6 },
    body: { paddingHorizontal: 16, paddingBottom: 13 }, description: { color: colors.secondaryText, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 19 },
    genres: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 11 }, genre: { backgroundColor: `${colors.gold}09`, borderWidth: 1, borderColor: `${colors.gold}20`, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
    genreText: { color: colors.gold, fontFamily: 'Inter_500Medium', fontSize: 10 },
    links: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    link: { flex: 1, minHeight: 48, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
    linkText: { color: colors.gold, fontFamily: 'Inter_600SemiBold', fontSize: 11 },
    manage: { minHeight: 46, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, flexDirection: 'row', gap: 9, alignItems: 'center' },
    manageCopy: { flex: 1 }, manageTitle: { color: colors.text, fontFamily: 'Inter_600SemiBold', fontSize: 11 },
    manageNote: { color: colors.mutedText, fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 3 },
    rules: { marginHorizontal: 16, marginBottom: 14, padding: 12, borderRadius: 12, backgroundColor: `${colors.gold}06`, borderWidth: 1, borderColor: `${colors.gold}25` },
    rulesTitle: { color: colors.gold, fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: .8, marginBottom: 6 },
    editRules: { minHeight: 40, justifyContent: 'center', alignSelf: 'flex-start' }, pressed: { opacity: .75 },
  }), [colors]);
  const owner = club.membership_role === 'owner';
  const manager = owner || club.membership_role === 'admin';
  const showRules = Boolean(club.rules?.trim()) || owner;
  return <View style={styles.shadow}><View style={styles.card}>
    <View style={styles.accent} /><View style={styles.glow} pointerEvents="none" accessible={false} />
    <View style={styles.identity}>
      <Pressable disabled={!club.cover_url} onPress={onPhoto} accessibilityRole="button" accessibilityLabel="Enlarge club photo" style={styles.photo}>
        {club.cover_url ? <Image source={{ uri: moderationMediaUrl(club.cover_url) }} style={styles.image} /> : <Text style={styles.initial}>{club.name.charAt(0).toUpperCase()}</Text>}
      </Pressable>
      <View style={styles.identityCopy}>
        <View style={styles.badges}><Ionicons name={club.privacy === 'private' ? 'lock-closed-outline' : 'earth-outline'} size={12} color={colors.gold} />
          <Text style={styles.badge}>{club.privacy === 'private' ? 'Private club' : 'Public club'}</Text>
          {club.membership_role ? <Text style={styles.badge}>· {owner ? 'Owner' : manager ? 'Admin' : 'Member'}</Text> : null}
        </View>
        <Text style={styles.name}>{club.name}</Text><Text style={styles.members}>{club.member_count.toLocaleString()} {club.member_count === 1 ? 'member' : 'members'}</Text>
      </View>
    </View>
    {club.description || club.genres?.length ? <View style={styles.body}>
      {club.description ? <Text style={styles.description} numberOfLines={descriptionExpanded ? undefined : 4}>{club.description}</Text> : null}
      {((club.description ?? '').length > 180 || (club.description ?? '').split('\n').length > 4) ? <Pressable accessibilityRole="button" accessibilityLabel={descriptionExpanded ? 'Show less club description' : 'Read full club description'} onPress={() => setDescriptionExpanded(value => !value)} style={styles.editRules}><Text style={styles.linkText}>{descriptionExpanded ? 'Show less' : 'Read more'}</Text></Pressable> : null}
      {club.genres?.length ? <View style={styles.genres}>{club.genres.map(genre => <View key={genre} style={styles.genre}><Text style={styles.genreText}>{getClubGenreLabel(genre)}</Text></View>)}</View> : null}
    </View> : null}
    {canViewMembers || showRules ? <View style={styles.links}>
      {canViewMembers ? <Pressable accessibilityRole="button" accessibilityLabel={membersVisible ? 'Hide club members' : 'View club members'} onPress={onMembers} style={({ pressed }) => [styles.link, pressed && styles.pressed]}><Ionicons name="people-outline" size={16} color={colors.gold} /><Text style={styles.linkText}>Members</Text></Pressable> : null}
      {showRules ? <Pressable accessibilityRole="button" accessibilityLabel={rulesExpanded ? 'Hide club rules' : 'View club rules'} onPress={onRules} style={({ pressed }) => [styles.link, pressed && styles.pressed]}><Ionicons name="reader-outline" size={16} color={colors.gold} /><Text style={styles.linkText}>{club.rules?.trim() ? 'Club rules' : 'Add rules'}</Text></Pressable> : null}
    </View> : null}
    {rulesExpanded && showRules ? <View style={styles.rules}><Text style={styles.rulesTitle}>CLUB RULES</Text><Text style={styles.description}>{club.rules?.trim() || 'Set a few guidelines to help everyone feel at home in your club.'}</Text>
      {owner ? <Pressable accessibilityRole="button" accessibilityLabel="Edit club rules" onPress={onEdit} style={styles.editRules}><Text style={styles.linkText}>{club.rules?.trim() ? 'Edit rules' : 'Add rules'}</Text></Pressable> : null}
    </View> : null}
    {manager ? <Pressable accessibilityRole="button" accessibilityLabel={managementVisible ? 'Hide club management' : 'Manage club members and invitations'} onPress={onManage} style={({ pressed }) => [styles.manage, pressed && styles.pressed]}>
      <Ionicons name="shield-checkmark-outline" size={17} color={colors.gold} /><View style={styles.manageCopy}><Text style={styles.manageTitle}>Manage club</Text>
        <Text style={styles.manageNote}>{pendingRequests || pendingInvites ? `${pendingRequests} join ${pendingRequests === 1 ? 'request' : 'requests'} · ${pendingInvites} pending ${pendingInvites === 1 ? 'invite' : 'invites'}` : 'Members, invitations, and join requests'}</Text></View>
      <Ionicons name={managementVisible ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedText} />
    </Pressable> : null}
  </View></View>;
}
