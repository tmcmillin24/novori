import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { NovoriColors } from '../constants/novori-theme';
import { useNovoriTheme } from '../context/theme-context';
import { ClubWithMembership } from '../lib/clubs';
import ClubDestinationImage from './ClubDestinationImage';
import { PostComposerProfile } from '../hooks/use-post-composer-profile';

type Props = {
  clubs: ClubWithMembership[];
  clubId: string | null;
  clubName?: string | null;
  loading?: boolean;
  disabled?: boolean;
  onClubIdChange: (clubId: string | null) => void;
  profile?: PostComposerProfile | null;
};

// Match Regular Post's top destination bar; the card only displays the choice.
export default function PostDestinationPicker({
  clubs, clubId, clubName, loading = false, disabled = false, onClubIdChange, profile,
}: Props) {
  const { colors } = useNovoriTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [expanded, setExpanded] = useState(false);
  const selectedClub = clubs.find((club) => club.id === clubId);
  const title = clubId ? selectedClub?.name || clubName || 'Your club' : 'Your feed';
  const locked = loading || disabled;
  const initial = (profile?.display_name?.trim() || profile?.username?.trim() || 'You').charAt(0).toUpperCase();

  function feedPhoto(size: number) {
    const frame = [styles.feedImage, { width: size, height: size, borderRadius: size / 2 }];
    return profile?.avatar_url ? (
      <Image source={{ uri: profile.avatar_url }} contentFit="cover" cachePolicy="memory-disk"
        recyclingKey={profile.avatar_url} style={frame} accessibilityLabel="Your profile photo" />
    ) : (
      <View style={frame}><Text style={styles.feedInitial}>{initial}</Text></View>
    );
  }

  function selectDestination(id: string | null) {
    onClubIdChange(id);
    setExpanded(false);
  }

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Post to ${title}`}
        accessibilityHint="Choose your feed or a joined club."
        accessibilityState={{ expanded, disabled: locked }}
        disabled={locked}
        onPress={() => setExpanded((current) => !current)}
        style={({ pressed }) => [styles.bar, expanded && styles.barOpen, pressed && styles.pressed]}
      >
        {clubId ? (
          <View style={styles.image}>
            <ClubDestinationImage club={selectedClub ?? { name: title, cover_url: null }} size={42} />
          </View>
        ) : null}
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>POST TO</Text>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <Text style={styles.subtitle}>{clubId ? 'Club' : 'Your followers'}</Text>
        </View>
        {loading ? <ActivityIndicator size="small" color={colors.gold} /> : (
          <View style={styles.chevron}>
            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.gold} />
          </View>
        )}
      </Pressable>
      {expanded ? (
        <View style={styles.dropdown}>
          {[{ id: null, name: 'Your feed', cover_url: null }, ...clubs].map((club) => {
            const selected = club.id === clubId;
            return (
              <Pressable
                key={club.id ?? 'feed'}
                accessibilityRole="button"
                accessibilityLabel={`Choose ${club.name}`}
                accessibilityState={{ selected, disabled: locked }}
                disabled={locked}
                onPress={() => selectDestination(club.id)}
                style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.pressed]}
              >
                <View style={styles.optionImage}>
                  {club.id ? <ClubDestinationImage club={club} size={36} /> : feedPhoto(36)}
                </View>
                <View style={styles.copy}>
                  <Text style={[styles.optionTitle, selected && styles.optionTitleSelected]} numberOfLines={1}>{club.name}</Text>
                  <Text style={styles.optionSubtitle}>{club.id ? 'Club' : 'Your followers'}</Text>
                </View>
                {selected ? <Ionicons name="checkmark-circle" size={20} color={colors.gold} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function createStyles(colors: NovoriColors) {
  return StyleSheet.create({
    container: { marginBottom: 14 },
    bar: { minHeight: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    barOpen: { borderBottomColor: colors.gold },
    image: { marginRight: 11 },
    copy: { flex: 1, minWidth: 0 },
    eyebrow: { color: colors.mutedText, fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.1, marginBottom: 2 },
    title: { color: colors.text, fontFamily: 'Inter_600SemiBold', fontSize: 15 },
    subtitle: { color: colors.mutedText, fontFamily: 'Inter_400Regular', fontSize: 10.5, marginTop: 2 },
    chevron: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.elevated },
    dropdown: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingVertical: 4 },
    option: { minHeight: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, borderRadius: 14 },
    optionSelected: { backgroundColor: colors.elevated },
    optionImage: { marginRight: 10 },
    feedImage: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' },
    feedInitial: { color: colors.gold, fontFamily: 'Inter_700Bold', fontSize: 15 },
    optionTitle: { color: colors.text, fontFamily: 'Inter_600SemiBold', fontSize: 13 },
    optionTitleSelected: { color: colors.gold },
    optionSubtitle: { color: colors.mutedText, fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 2 },
    pressed: { opacity: 0.72 },
  });
}
