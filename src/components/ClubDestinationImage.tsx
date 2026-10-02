import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { useNovoriTheme } from '../context/theme-context';

export default function ClubDestinationImage({ club, size = 30 }: {
  club: { name: string; cover_url: string | null };
  size?: number;
}) {
  const { colors } = useNovoriTheme();
  const frame = {
    width: size, height: size, borderRadius: size / 4,
    backgroundColor: colors.elevated, borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  };
  return club.cover_url ? (
    <Image source={{ uri: club.cover_url }} contentFit="cover" cachePolicy="memory-disk"
      recyclingKey={club.cover_url} style={frame} accessibilityLabel={`${club.name} club photo`} />
  ) : (
    <View style={[frame, { alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ color: colors.gold, fontFamily: 'Inter_700Bold', fontSize: size * 0.45 }}>
        {club.name.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}
